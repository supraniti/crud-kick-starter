import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";

function CollectionContractPanel({
  collectionsState,
  schemaState,
  collectionSelectValue,
  controlsDisabled,
  noCollectionsAvailable,
  unavailableMessage,
  onOpenRemotes,
  onSelectCollection,
  referenceOptionsState,
  isUnavailableDuplicate
}) {
  const referenceErrors = [
    ...new Set(
      Object.values(referenceOptionsState ?? {})
        .map((entry) => entry?.errorMessage)
        .filter((message) => typeof message === "string" && message.length > 0)
    )
  ];
  const collectionSelectId = "collection-select-input";

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Collection contract</Typography>
        {collectionsState.loading || schemaState.loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading collection metadata...</Typography>
          </Stack>
        ) : null}
        {collectionsState.errorMessage ? (
          <Alert severity="error">{collectionsState.errorMessage}</Alert>
        ) : null}
        {noCollectionsAvailable ? (
          <Alert
            severity="warning"
            action={
              onOpenRemotes ? (
                <Button size="small" onClick={onOpenRemotes}>
                  Open remotes
                </Button>
              ) : null
            }
          >
            No active collections are currently available.
          </Alert>
        ) : null}
        {controlsDisabled ? (
          <Alert
            severity="warning"
            action={
              onOpenRemotes ? (
                <Button size="small" onClick={onOpenRemotes}>
                  Open remotes
                </Button>
              ) : null
            }
          >
            {unavailableMessage ??
              "Active collection is unavailable. Re-enable its owning module in runtime controls."}
          </Alert>
        ) : null}
        {schemaState.errorMessage && !isUnavailableDuplicate(schemaState.errorMessage) ? (
          <Alert severity="error">{schemaState.errorMessage}</Alert>
        ) : null}
        {referenceErrors.map((errorMessage) => (
          <Alert key={errorMessage} severity="error">
            {errorMessage}
          </Alert>
        ))}
        <FormControl size="small" sx={{ maxWidth: 240 }}>
          <InputLabel id="collection-select-label">Collection</InputLabel>
          <Select
            id={collectionSelectId}
            labelId="collection-select-label"
            label="Collection"
            value={collectionSelectValue}
            disabled={collectionsState.loading || noCollectionsAvailable}
            onChange={(event) => onSelectCollection(event.target.value)}
            inputProps={{
              id: `${collectionSelectId}-value`,
              name: "collection"
            }}
          >
            {(collectionsState.items ?? []).map((collection) => (
              <MenuItem key={collection.id} value={collection.id}>
                {collection.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {schemaState.collection ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Collection: ${schemaState.collection.label}`} />
            <Chip size="small" label={`Primary: ${schemaState.collection.primaryField}`} />
            <Chip size="small" label={`Fields: ${schemaState.collection.fields?.length ?? 0}`} />
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export { CollectionContractPanel };
