#!/bin/bash
SECRETNAME=$1
NEWFILE=$2

export KUBECONFIG=/etc/kubernetes/admin.conf

NEWCONTENT=$(cat $NEWFILE | base64)
PATCH=$(printf "data:\n  ${NEWFILE}: ${NEWCONTENT}")

kubectl patch secret $SECRETNAME -p "$PATCH"
