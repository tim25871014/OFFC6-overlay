// Build a URL into the public/_data folder that ships verbatim in dist.
// import.meta.env.BASE_URL is '/' in dev and './' for the relative-base build,
// so config fetches and asset URLs resolve correctly in both.
export const dataPath = (p) =>
  `${import.meta.env.BASE_URL}_data/${String(p).replace(/^\/+/, '')}`
