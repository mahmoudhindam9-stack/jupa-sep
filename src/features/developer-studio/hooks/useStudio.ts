/**
 * Developer Studio Pro — React Hooks for Editor & Runtime Page Rendering
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  StudioDraft,
  StudioPublishedConfig,
  ElementModel,
  PageModel,
  ElementType,
  uniquePageElementIds,
} from "../models/studio.types";
import { studioService, DEFAULT_STUDIO_PUBLISHED_CONFIG } from "../services/studioService";

/**
 * Runtime hook: Get published elements for a specific application route (e.g. /admin, /admin/restaurant)
 * Purely isolated from drafts; only exposes published configurations to application users.
 */
export function useStudioPublishedPage(route: string) {
  const [published, setPublished] = useState<StudioPublishedConfig>(DEFAULT_STUDIO_PUBLISHED_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    studioService.getPublishedConfig().then((cfg) => {
      if (mounted) {
        setPublished(cfg);
        setIsLoading(false);
      }
    });

    const handler = (e: any) => {
      if (e.detail) {
        setPublished(e.detail);
      }
    };

    window.addEventListener("studio_published_updated", handler);
    return () => {
      mounted = false;
      window.removeEventListener("studio_published_updated", handler);
    };
  }, []);

  const page = useMemo(() => {
    return Object.values(published.pages || {}).find((p) => p.route === route) || null;
  }, [published, route]);

  const elements = useMemo(() => {
    if (!page || !page.elementIds) return [];
    // elementIds stores both parent and child references. Rendering every ID here
    // duplicates each child: the parent renderer already renders its descendants.
    // Render only unique, visible roots and let StudioElementRenderer recurse once.
    return uniquePageElementIds(page.elementIds)
      .map((id) => published.elements[id])
      .filter((el): el is ElementModel =>
        !!el &&
        el.pageId === page.id &&
        el.parentId === null &&
        el.layout?.visibility !== false,
      );
  }, [page, published]);

  return {
    page,
    elements,
    allElements: published.elements,
    revision: published.revision,
    isLoading,
  };
}
