const missingRelationPattern =
  /relation .* does not exist|table .* does not exist|could not find the table '.*' in the schema cache/i;
const missingFunctionPattern =
  /function .* does not exist|could not find the function .* in the schema cache|send_connection_request|get_or_create_direct_conversation|respond_to_connection_request/i;

export const CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE =
  "Connections are unavailable until the latest Supabase migrations are applied.";

export const CONNECTION_SCHEMA_UNAVAILABLE_DETAIL =
  "Run `npm run supabase:migrate` or apply `supabase/migrations/*.sql` to the target Supabase database.";

export const isMissingConnectionSchemaError = (message: string) =>
  missingRelationPattern.test(message) || missingFunctionPattern.test(message);

export const toConnectionSetupMessage = (message?: string | null) =>
  isMissingConnectionSchemaError(message || "")
    ? `${CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE} ${CONNECTION_SCHEMA_UNAVAILABLE_DETAIL}`
    : (message || "").trim();
