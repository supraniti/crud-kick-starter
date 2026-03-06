import { useRef, useState } from "react";
import {
  DEFAULT_COLLECTION_ID,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState
} from "../../domain-helpers.js";
import { createDefaultInlineCreateState } from "../../domain-runtime-helpers.js";
import {
  createDefaultCollectionItemsState,
  createDefaultCollectionReferenceOptionsState,
  createDefaultCollectionSchemaState,
  createDefaultCollectionsState
} from "../../state-helpers.js";

function useCollectionsDomainState() {
  const [collectionsState, setCollectionsState] = useState(() =>
    createDefaultCollectionsState()
  );
  const [collectionSchemaState, setCollectionSchemaState] = useState(() =>
    createDefaultCollectionSchemaState()
  );
  const [collectionItemsState, setCollectionItemsState] = useState(() =>
    createDefaultCollectionItemsState()
  );
  const [referenceOptionsState, setReferenceOptionsState] = useState(() =>
    createDefaultCollectionReferenceOptionsState()
  );
  const [moduleCollectionMap, setModuleCollectionMap] = useState({});
  const collectionScopeRef = useRef("");
  const [activeCollectionId, setActiveCollectionId] = useState(DEFAULT_COLLECTION_ID);
  const [collectionItemsReloadToken, setCollectionItemsReloadToken] = useState(0);
  const [collectionFilterState, setCollectionFilterState] = useState(() =>
    createDefaultCollectionFilterState(DEFAULT_COLLECTION_ID)
  );
  const [collectionFormState, setCollectionFormState] = useState(() =>
    createDefaultCollectionFormState(DEFAULT_COLLECTION_ID)
  );
  const [inlineCreateState, setInlineCreateState] = useState(() =>
    createDefaultInlineCreateState()
  );

  return {
    collectionsState,
    setCollectionsState,
    collectionSchemaState,
    setCollectionSchemaState,
    collectionItemsState,
    setCollectionItemsState,
    referenceOptionsState,
    setReferenceOptionsState,
    moduleCollectionMap,
    setModuleCollectionMap,
    collectionScopeRef,
    activeCollectionId,
    setActiveCollectionId,
    collectionItemsReloadToken,
    setCollectionItemsReloadToken,
    collectionFilterState,
    setCollectionFilterState,
    collectionFormState,
    setCollectionFormState,
    inlineCreateState,
    setInlineCreateState
  };
}

export { useCollectionsDomainState };
