<script lang="ts">
  import { appMetadata } from "@shaxda/shared";
  import { siteContent } from "@shaxda/i18n";
  import { absoluteUrl, ogImagePath } from "$lib/site/metadata";

  let {
    title,
    description,
    path,
  }: { title: string; description: string; path: string } = $props();

  const pageTitle = $derived(
    title === appMetadata.name ? title : `${title} | ${appMetadata.name}`,
  );
  const canonicalUrl = $derived(absoluteUrl(path));
  const imageUrl = $derived(absoluteUrl(ogImagePath));
  const imageAlt = siteContent.so.metadata.ogImageAlt;
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={appMetadata.name} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content={imageAlt} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
