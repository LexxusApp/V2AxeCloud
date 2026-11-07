import fs from 'node:fs';

const targets = [
  'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/api/lib/consulentePortalRoutes.ts',
  'c:/Users/Lucas A/Desktop/AxecloudV2/.codex-publish-terreiros/api/lib/consulentePortalRoutes.ts',
  'c:/Users/Lucas A/Desktop/AxecloudV2/_codex-perf-preview/api/lib/consulentePortalRoutes.ts',
  'c:/Users/Lucas A/Desktop/AxecloudV2/_codex-prod-release/api/lib/consulentePortalRoutes.ts'
];

const newSnippet = `      const metrics = {
        viewsTotal: 0,
        views30: 0,
        views7: 0,
        directoryClicks30: 0,
        googleViews30: 0,
        whatsappClicks30: 0,
      };

      try {
        const now = Date.now();
        const d30 = now - 30 * 86_400_000;
        const d7 = now - 7 * 86_400_000;

        // 1. Query access_logs by target_id
        const { data: logsById } = await sb
          .from("access_logs")
          .select("created_at, event_type, metadata")
          .eq("target_type", "directory_terreiro")
          .eq("target_id", data.id)
          .in("event_type", ["directory.profile_click", "directory.profile_google_view", "directory.whatsapp_click"]);

        // 2. Query access_logs by slug if available
        let logsBySlug: any[] = [];
        if (data.slug) {
          const { data: slugLogs } = await sb
            .from("access_logs")
            .select("created_at, event_type, metadata")
            .contains("metadata", { slug: data.slug })
            .in("event_type", ["directory.profile_click", "directory.profile_google_view", "directory.whatsapp_click"]);
          logsBySlug = slugLogs || [];
        }

        // Deduplicate access_logs rows by created_at + event_type
        const seen = new Set<string>();
        const allLogs: any[] = [];
        for (const row of [...(logsById || []), ...logsBySlug]) {
          const key = \`\${row.created_at}_\${row.event_type}\`;
          if (!seen.has(key)) {
            seen.add(key);
            allLogs.push(row);
          }
        }

        for (const row of allLogs) {
          const t = new Date(row.created_at).getTime();
          metrics.viewsTotal++;
          const is30 = t >= d30;
          const is7 = t >= d7;

          if (is7) metrics.views7++;
          if (is30) {
            metrics.views30++;
            const md = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
            const fromGoogle =
              row.event_type === "directory.profile_google_view" ||
              md.google === true ||
              String(md.channel || "").startsWith("google_") ||
              String(md.source || "").toLowerCase().includes("google");
            if (fromGoogle) metrics.googleViews30++;
            if (row.event_type === "directory.profile_click") metrics.directoryClicks30++;
            if (row.event_type === "directory.whatsapp_click") metrics.whatsappClicks30++;
          }
        }

        // 3. Query public_conversion_events for additional interactions
        if (data.slug) {
          const { data: pceRows } = await sb
            .from("public_conversion_events")
            .select("created_at, event_name, metadata, path, referrer")
            .or(\`path.eq./terreiro/\${data.slug},metadata->>slug.eq.\${data.slug}\`);

          if (Array.isArray(pceRows)) {
            for (const p of pceRows) {
              const t = new Date(p.created_at).getTime();
              const is30 = t >= d30;
              const is7 = t >= d7;
              metrics.viewsTotal++;
              if (is7) metrics.views7++;
              if (is30) {
                metrics.views30++;
                const isGoogle = String(p.referrer || "").toLowerCase().includes("google");
                if (isGoogle) metrics.googleViews30++;
                else metrics.directoryClicks30++;

                const action = String(p.metadata?.action || (p as any).cta_id || "").toLowerCase();
                if (action.includes("whatsapp")) metrics.whatsappClicks30++;
              }
            }
          }
        }
      } catch (errLog) {
        console.warn("[settings/directory-profile] warn fetching metrics:", errLog);
      }
`;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) {
    console.log("File not found, skipping:", filePath);
    continue;
  }
  let content = fs.readFileSync(filePath, "utf8");
  
  // Check if metrics block already exists
  const targetIndex = content.indexOf("const metrics = {");
  if (targetIndex !== -1) {
    const endMatch = "return res.json({";
    const endIndex = content.indexOf(endMatch, targetIndex);
    if (endIndex !== -1) {
      content = content.slice(0, targetIndex) + newSnippet + "\n      " + content.slice(endIndex);
    }
  } else {
    // If not found (like in .codex-publish-terreiros), inject before return res.json({
    const anchor = ".maybeSingle();";
    const anchorIndex = content.indexOf(anchor);
    // There are two maybeSingle in the route: the first for data, second for identity
    const secondAnchorIndex = content.indexOf(anchor, anchorIndex + anchor.length);
    if (secondAnchorIndex !== -1) {
      const injectAt = secondAnchorIndex + anchor.length;
      content = content.slice(0, injectAt) + "\n\n" + newSnippet + "\n" + content.slice(injectAt);
      
      // Also make sure 'metrics,' is in return res.json
      content = content.replace("claimed: true,", "claimed: true,\n        metrics,");
    }
  }

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Updated:", filePath);
}
