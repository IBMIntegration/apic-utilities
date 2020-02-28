# Offloading Analytics in APIC to TLS Authenticated Service
Ben Cornwell, IBM

18/2/2020

## Introduction
APIC collects analytics data regarding usage of APIs, using a dedicated analytics system which is distinct from the other components.  The analytics system in APIC is based on Logstash, and it can be configured via Logstash configuration files which are available in the GUI.   By default, the analytics information is stored locally on the cluster, however it is possible to configure the system to off-load analytics information to an external source.

In APIC it is possible to configure four of the standard Logstash plugins: Kafka, syslog, Elastisearch and generic HTTP.  This article deals with the HTTP method.  The HTTP output plugin allows headers to be added to support basic authentication with the remote service, and it also allows TLS authentication.

The procedure in this document is implemented in a script available on GitHub: https://github.com/IBMIntegration/apic-utilities/tree/master/key-insert

A test server written in Node.js is available at https://github.com/IBMIntegration/apic-utilities/tree/master/client-auth-server

## Configuring Off-load in APIC
TLS authentication in Logstash is straightforward to configure. In the management console there is a configuration page where the configuration can be added as a JSON snippet, in its most simple form like so:

```
output {
  http {
    url => "https://<target url>"
    http_method => "post"
    codec => "json"
    content_type => "application/json"
    client_cert => "<my cert>.pem"
    client_key => "<my key>.pem"
    cacert => "<my ca cert>.pem"
    id => "offload_http"
  }
}
```

The client certificate, key and the associated CA certificate can be supplied here.

### Problem
In APIC 2018 however, Logstash is running as a pod in Kubernetes, which makes it slightly more difficult to supply the certificates.  They cannot simply be copied into the pod as pods are ephemeral and can be recreated at will during normal running conditions at which point any changes to the storage would be lost.

### Solution
The normal Kubernetes way to solve this is to mount external volumes to a pod that refer to a location on the host node’s filesystem which is persistent.  So when a pod restarts, it re-mounts the volumes and finds all its persistent data still there.  However, API Connect is a product supplied by a software vendor (IBM) and as such reconfiguring its components is generally a bad idea.

Pod volumes do not always have to be filesystem locations though.  A Kubernetes secret can be mounted as a volume.  Secrets are encrypted at rest, and access is controlled, to provide security so that sensitive information e.g. passwords, encryption keys can be stored.  Each piece of information is stored in the secret as a key/value pair, with the value also base 64 encoded.  When mounted to a pod as a volume, the key becomes a filename whose contents are the decoded value.

Since secrets are configuration data, it can be considered acceptable to modify the secrets in an APIC cluster post-installation, and this way the required client certificates can be made available to the Logstash pod

## Example
### Configuring the Secret

Logstash provides the analytics ingestion from the other components in APIC and runs in a pod called analytics-ingestion-XXX.  In an OVA installation each virtual machine hosts a node dedicated to a particular APIC component, so all the analytics pods are on the same node.  In a Kubernetes installation, the analytics pods and secrets are deployed into the namespace specified during installation.

Alongside (in the default namespace) are the secrets used by the analytics pods to contain the certificates they use to communicate with the other components.  The secret analytics-XXX is mounted to the analytics ingestion pod, so this is the one to which the required client certificates can be added.  Three certificates are required – the client certificate, the client key and the CA certificate with which they were signed, unless they were provided by a CA known to the OS.

The certificates can be added with the kubectl patch command.  This inserts or replaces YAML elements into an existing object.  The desired content of the files (in this case the certificates and keys) must be based 64 encoded in their entirety otherwise they will be rejected by Kubernetes. (Even certificates, because the begin and end lines are not encoded even though the rest of the content is)

The secret looks like this (encoded data is truncated to aid readability):
```
apiVersion: v1
data:
  analytics-operator_client_private.key.pem: LS0tLS1CRUdJTiBSU0EgUFJJV…
  analytics-operator_client_public.cert.pem: LS0tLS1CRUdJTiBDRVJUSUZJQ…
  analytics-operator_private.key.pem: LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBL…
  analytics-operator_public.cert.pem: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0t…
  cacert.pem: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUREakNDQWZhZ0F3…
  password.txt: ""
kind: Secret
…
```
The elements in the data section are mapped into files in the pod – the name of the element becomes the name of the file and the value becomes the file content.  The values MUST be base 64 encoded.

The secret is mounted in the pod to the directory `/etc/velox/certs`.

Therefore, within the pod the directory `/etc/velox/certs` looks like this – note the filenames match the YAML elements above:

```
analytics-ingestion_client_private.key.pem  
analytics-ingestion_private.key.pem
password.txt
analytics-ingestion_client_public.cert.pem
analytics-ingestion_public.cert.pem  
cacert.pem
```

We need to add YAML elements to the secret to represent our new certificates.  If performing this change manually, the additional YAML to add content to or overwrite content in the secret e.g. analytics-ingestion-velox-certs-XXX can be contained in a file e.g my-patch.yaml, whose contents are as follows:

```
data:
  new-content.pem: <base64 encoded content>
```

 and the command looks like this:

```
kubectl patch secret analytics-ingestion-velox-certs-XXX “$(cat my-patch.yaml)”
```

Alternatively, in a shell script a string representation might be more appropriate:

```
SECRETNAME=analytics-ingestion-velox-certs-XXX
YAML=$'data:\n  new-content: <base64 encoded content>'
kubectl patch secret $SECRETNAME -p $YAML
```

Once the patch command is executed the pod will automatically pick up the changes, but this can take several minutes.

To verify the results of the process, open a shell inside the pod and examine the directory:

```
$ kc exec -it apic-analytics-analytics-ingestion-XXX /bin/bash
# cd /etc/velox/certs
# ls
```
The results should be as follows:

```
analytics-ingestion_client_private.key.pem  
analytics-ingestion_private.key.pem
password.txt
analytics-ingestion_client_public.cert.pem
analytics-ingestion_public.cert.pem  
cacert.pem
newcontent.pem
```

The contents of the file newcontent.pem should appear as the decoded version of the content supplied in the YAML.

### Configuring APIC

To configure analytics offload in APIC, three files are required:

* The client public key in PKCS8 format
* The client certificate
* The CA certificate that signs the client certificate

Using the above procedure, or with reference to the scripts at https://github.com/IBMIntegration/apic-utilities/tree/master/key-insert add these three files to the `apic-analytics-analytics-ingestion-XXX` secret.

From the cloud management console in APIC, select ‘Configure Topology’ then select the analytics service.  Select ‘Advanced Analytics Configuration’ at the bottom of the page.  Under ‘API Connect’ on the next page click the ‘Ingestion’ link.  The following screen contains tabs for the config files in the Logstash pipeline.

On the far left, select ‘Outputs.yml’ and change offload_output_enabled to true.

On the far right click on ‘offload_output.conf’.  In the text area, paste the following configuration, substituting the appropriate certificate filenames

```
output {
  http {
    url => "<offload-url>"
    http_method => "post"
    codec => "json"
    content_type => "application/json"
    client_cert => "/etc/velox/certs/<client-cert-filename>"
    client_key => "/etc/velox/certs/<client-key-filename>"
    cacert => "/etc/velox/certs/<ca-certificate-filename>"
    id => "offload_http"
   }
}
```

Finally, click ‘Save’ at the bottom of the page.  This completes the configuration.  Verify that log messages are being offloaded by running load through APIC and checking the target system.
