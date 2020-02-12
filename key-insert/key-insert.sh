#!/bin/bash
SECRETNAME=$1
NEWFILE=$2
NEWCONTENT=$3

export KUBECONFIG=/etc/kubernetes/admin.conf

SECRET=$(kubectl get secret $SECRETNAME -o yaml)

LINE=$(grep $NEWFILE <<< "$SECRET")

if [[ $LINE ]]; then
  NEWLINE=$NEWFILE:' '$(echo $(cut -d ':' -f2 <<< $LINE) | sed -E "s|[a-zA-Z0-9+/]*={0,2}|$NEWCONTENT|")
  echo $NEWLINE
  NEWSECRET=$(sed -E "s/$LINE/\ \ $NEWLINE/" <<< "$SECRET")
else
  NEWSECRET=$(sed -E "/^data/a \ \ $NEWFILE:\ $NEWCONTENT" <<< "$SECRET")
fi

echo "$NEWSECRET" | kubectl apply -f -
