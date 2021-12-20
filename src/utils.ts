export function parseQuery(query: string) {
  const url = new URL('/?' + query, 'http://xxx.com');

  return url.searchParams;
}
