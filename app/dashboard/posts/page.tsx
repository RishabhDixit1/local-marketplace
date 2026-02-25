import { redirect } from "next/navigation";

type SearchParamValue = string | string[] | undefined;

type Props = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

const pickFirst = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value);

export default async function LegacyPostsRedirect({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const normalizedValue = pickFirst(value);
    if (normalizedValue) {
      nextParams.set(key, normalizedValue);
    }
  }

  const query = nextParams.toString();
  redirect(query ? `/dashboard?${query}` : "/dashboard");
}
