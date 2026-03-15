{{- define "schizm.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "schizm.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "schizm.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "schizm.labels" -}}
app.kubernetes.io/name: {{ include "schizm.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "schizm.selectorLabels" -}}
app.kubernetes.io/name: {{ include "schizm.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "schizm.apiName" -}}
{{- printf "%s-api" (include "schizm.fullname" .) -}}
{{- end -}}

{{- define "schizm.webName" -}}
{{- printf "%s-web" (include "schizm.fullname" .) -}}
{{- end -}}

{{- define "schizm.image" -}}
{{- printf "%s:%s" .Values.image.repository .Values.image.tag -}}
{{- end -}}

{{- define "schizm.apiConfigMapName" -}}
{{- if .Values.api.existingConfigMap -}}
{{- .Values.api.existingConfigMap -}}
{{- else -}}
{{- printf "%s-env" (include "schizm.apiName" .) -}}
{{- end -}}
{{- end -}}

{{- define "schizm.webConfigMapName" -}}
{{- if .Values.web.existingConfigMap -}}
{{- .Values.web.existingConfigMap -}}
{{- else -}}
{{- printf "%s-env" (include "schizm.webName" .) -}}
{{- end -}}
{{- end -}}

{{- define "schizm.apiSecretName" -}}
{{- if .Values.api.existingSecret -}}
{{- .Values.api.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" (include "schizm.apiName" .) -}}
{{- end -}}
{{- end -}}

{{- define "schizm.webSecretName" -}}
{{- if .Values.web.existingSecret -}}
{{- .Values.web.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" (include "schizm.webName" .) -}}
{{- end -}}
{{- end -}}

{{- define "schizm.publicScheme" -}}
{{- default "https" .Values.global.publicScheme -}}
{{- end -}}

{{- define "schizm.publicDomain" -}}
{{- $domain := default "" .Values.global.publicDomain -}}
{{- if $domain -}}
{{- $domain -}}
{{- else if .Values.web.ingress.host -}}
{{- .Values.web.ingress.host -}}
{{- else if gt (len (default (list) .Values.web.ingress.hosts)) 0 -}}
{{- (index .Values.web.ingress.hosts 0).host -}}
{{- end -}}
{{- end -}}

{{- define "schizm.defaultTlsSecretName" -}}
{{- $domain := include "schizm.publicDomain" . | trim -}}
{{- if $domain -}}
{{- printf "tls-%s" ($domain | replace "." "-") -}}
{{- end -}}
{{- end -}}

{{- define "schizm.publicWebSocketUrl" -}}
{{- printf "%s://%s/graphql" (ternary "wss" "ws" (eq (include "schizm.publicScheme" . | trim) "https")) (include "schizm.publicDomain" . | trim) -}}
{{- end -}}

{{- define "schizm.apiInternalUrl" -}}
{{- printf "http://%s:%v" (include "schizm.apiName" .) .Values.api.service.port -}}
{{- end -}}

{{- define "schizm.httpsRedirectMiddlewareName" -}}
{{- printf "%s-https-redirect" (include "schizm.webName" .) -}}
{{- end -}}

{{- define "schizm.httpsRedirectMiddlewareQualifiedName" -}}
{{- printf "%s-%s" .Release.Namespace (include "schizm.httpsRedirectMiddlewareName" .) -}}
{{- end -}}
