import { redirect } from "next/navigation";

type SearchParamValue = string | string[] | undefined;

type Props = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

const pickFirst = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value);

export default async function LegacyCreatePostRedirect({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const normalizedValue = pickFirst(value);
    if (normalizedValue) {
      nextParams.set(key, normalizedValue);
    }
  }

  nextParams.set("compose", "1");
  const query = nextParams.toString();

  redirect(`/dashboard?${query}`);
}
