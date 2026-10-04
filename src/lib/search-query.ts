export async function readQuery(
  searchParams:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>
    | undefined,
) {
  const query = searchParams ? await searchParams : {};
  const one = (key: string) => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) || "";
  };
  return { field: one("field"), region: one("region"), q: one("q"), status: one("status"), fee: one("fee") };
}
