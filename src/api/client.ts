import {
  ApiErrorResponseError,
  createApiClient,
} from '../../packages/api-client/src/index.ts'
import type { ApiResponseResult, ApiResult, ApiSuccess } from '../../packages/api-client/src/index.ts'
import { apiFetch } from './transport'

const apiClient = createApiClient(apiFetch)

export { ApiErrorResponseError }
export type { ApiResponseResult, ApiResult, ApiSuccess }

export const apiRequest = apiClient.apiRequest
export const apiRequestJson = apiClient.apiRequestJson
export const apiRequestResult = apiClient.apiRequestResult
export const apiGet = apiClient.apiGet
export const apiGetOptional = apiClient.apiGetOptional
export const apiGetEnvelope = apiClient.apiGetEnvelope
export const apiRequestEnvelope = apiClient.apiRequestEnvelope
export const apiGetRaw = apiClient.apiGetRaw
export const apiPostJson = apiClient.apiPostJson
export const apiPatchJson = apiClient.apiPatchJson
export const apiPutJson = apiClient.apiPutJson
export const apiDeleteJson = apiClient.apiDeleteJson
export const apiPostMultipart = apiClient.apiPostMultipart
