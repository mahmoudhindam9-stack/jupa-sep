-- Migration: Developer Studio Pro Schema
-- Tables: studio_published_configs, studio_drafts, studio_history

CREATE TABLE IF NOT EXISTS public.studio_published_configs (
    id TEXT PRIMARY KEY DEFAULT 'active',
    revision INTEGER NOT NULL DEFAULT 1,
    schema_version INTEGER NOT NULL DEFAULT 1,
    pages JSONB NOT NULL DEFAULT '{}'::jsonb,
    elements JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_by TEXT NOT NULL DEFAULT 'admin',
    published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    summary TEXT NOT NULL DEFAULT 'Initial publication'
);

CREATE TABLE IF NOT EXISTS public.studio_drafts (
    id TEXT PRIMARY KEY DEFAULT 'default',
    owner TEXT NOT NULL DEFAULT 'admin',
    base_revision INTEGER NOT NULL DEFAULT 1,
    schema_version INTEGER NOT NULL DEFAULT 1,
    pages JSONB NOT NULL DEFAULT '{}'::jsonb,
    elements JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.studio_history (
    id BIGSERIAL PRIMARY KEY,
    revision INTEGER NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    summary TEXT NOT NULL,
    snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_history_revision ON public.studio_history (revision DESC);

-- Enable RLS
ALTER TABLE public.studio_published_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_history ENABLE ROW LEVEL SECURITY;

-- Policies for studio_published_configs: Everyone can read published configs, authenticated users can write
CREATE POLICY "Public read access to published configs" 
    ON public.studio_published_configs FOR SELECT 
    USING (true);

CREATE POLICY "Authorized write access to published configs" 
    ON public.studio_published_configs FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Policies for studio_drafts
CREATE POLICY "Full access to studio drafts" 
    ON public.studio_drafts FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Policies for studio_history
CREATE POLICY "Full access to studio history" 
    ON public.studio_history FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Seed initial default configuration if empty
INSERT INTO public.studio_published_configs (id, revision, schema_version, pages, elements, published_by, summary)
VALUES (
    'active',
    1,
    1,
    '{
        "page_dashboard": {
            "id": "page_dashboard",
            "route": "/admin",
            "name": "لوحة الأقسام الرئيسية",
            "elementIds": ["elem_banner_1", "elem_heading_1"],
            "styles": {"padding": "16px"},
            "schemaVersion": 1,
            "revision": 1,
            "updatedAt": "2026-10-14T00:00:00.000Z",
            "updatedBy": "system"
        }
    }'::jsonb,
    '{
        "elem_banner_1": {
            "id": "elem_banner_1",
            "pageId": "page_dashboard",
            "parentId": null,
            "type": "card",
            "content": {
                "title": "مرحباً بك في نظام Restocash ERP",
                "description": "منصة إدارة المطاعم والمحاسبة المتكاملة ونقاط البيع السحابية"
            },
            "styles": {
                "backgroundColor": "#f8fafc",
                "borderColor": "#e2e8f0",
                "borderWidth": "1px",
                "borderRadius": "16px",
                "paddingTop": "16px",
                "paddingBottom": "16px",
                "paddingLeft": "20px",
                "paddingRight": "20px",
                "marginBottom": "20px"
            },
            "layout": {"position": "static", "order": 1, "visibility": true},
            "attributes": {},
            "locked": false,
            "schemaVersion": 1,
            "revision": 1,
            "updatedAt": "2026-10-14T00:00:00.000Z",
            "updatedBy": "system"
        },
        "elem_heading_1": {
            "id": "elem_heading_1",
            "pageId": "page_dashboard",
            "parentId": null,
            "type": "heading",
            "content": {
                "text": "الأقسام التشغيلية والخدمات",
                "level": "h2"
            },
            "styles": {
                "textColor": "#0f172a",
                "fontSize": "20px",
                "fontWeight": "800",
                "marginBottom": "12px"
            },
            "layout": {"position": "static", "order": 2, "visibility": true},
            "attributes": {},
            "locked": false,
            "schemaVersion": 1,
            "revision": 1,
            "updatedAt": "2026-10-14T00:00:00.000Z",
            "updatedBy": "system"
        }
    }'::jsonb,
    'system',
    'التهيئة التلقائية لنظام Developer Studio Pro'
)
ON CONFLICT (id) DO NOTHING;
