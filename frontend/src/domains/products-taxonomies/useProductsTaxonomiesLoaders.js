import { useEffect } from "react";
import { PRODUCTS_MODULE_ID, PRODUCTS_PAGE_LIMIT } from "./domain-helpers.js";

function useCategoriesLoader({
  activeModuleId,
  api,
  isAuthenticated,
  setCategoriesState
}) {
  useEffect(() => {
    if (!isAuthenticated || activeModuleId !== PRODUCTS_MODULE_ID) {
      return;
    }

    let cancelled = false;

    setCategoriesState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listCategories()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCategoriesState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCategoriesState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load categories",
          items: []
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeModuleId, api, isAuthenticated, setCategoriesState]);
}

function useTagsLoader({ api, isAuthenticated, setTagsState, tagsReloadToken }) {
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    setTagsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listTags()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setTagsState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setTagsState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load tags",
          items: []
        });
      });

    return () => {
      cancelled = true;
    };
  }, [api, isAuthenticated, setTagsState, tagsReloadToken]);
}

function useProductsLoader({
  activeModuleId,
  api,
  isAuthenticated,
  productsReloadToken,
  selectedCategoryIds,
  selectedCategoryKey,
  setProductsState
}) {
  useEffect(() => {
    if (!isAuthenticated || activeModuleId !== PRODUCTS_MODULE_ID) {
      return;
    }

    let cancelled = false;

    setProductsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listProducts({
        categoryIds: selectedCategoryIds,
        offset: 0,
        limit: PRODUCTS_PAGE_LIMIT
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setProductsState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? [],
          meta: {
            total: payload?.meta?.total ?? 0,
            offset: payload?.meta?.offset ?? 0,
            limit: payload?.meta?.limit ?? PRODUCTS_PAGE_LIMIT
          }
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setProductsState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load products",
          items: [],
          meta: {
            total: 0,
            offset: 0,
            limit: PRODUCTS_PAGE_LIMIT
          }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeModuleId,
    api,
    isAuthenticated,
    productsReloadToken,
    selectedCategoryIds,
    selectedCategoryKey,
    setProductsState
  ]);
}

export { useCategoriesLoader, useProductsLoader, useTagsLoader };
