export type WelcomeCommandResolution =
  | {
      kind: "refresh";
    }
  | {
      kind: "route";
      href: string;
    };

const trim = (value: string) => value.trim().toLowerCase();

export const resolveWelcomeCommand = (
  query: string,
  options: {
    defaultHref: string;
    providerDefaultHref?: string;
    isProvider: boolean;
  }
): WelcomeCommandResolution => {
  const normalized = trim(query);

  if (!normalized) {
    return {
      kind: "route",
      href: options.defaultHref,
    };
  }

  if (/(refresh|reload|sync|update)/.test(normalized)) {
    return { kind: "refresh" };
  }

  if (/(save|saved|bookmark|bookmarked|shortlist)/.test(normalized)) {
    return { kind: "route", href: "/dashboard/saved" };
  }

  if (/(chat|message|messages|dm|inbox)/.test(normalized)) {
    return { kind: "route", href: "/dashboard/chat" };
  }

  if (/(task|tasks|order|orders|work|workspace)/.test(normalized)) {
    return { kind: "route", href: "/dashboard/tasks" };
  }

  if (/(profile|bio|avatar|photo|contact|contacts|tag|tags|interest|interests)/.test(normalized)) {
    return { kind: "route", href: "/dashboard/profile" };
  }

  if (/(people|provider|providers|connection|connections|discover|discovery|nearby)/.test(normalized)) {
    return { kind: "route", href: "/dashboard/people" };
  }

  if (/(need|needs|post|request|requests|help)/.test(normalized)) {
    return { kind: "route", href: "/dashboard?compose=1" };
  }

  if (/(service|services|listing|listings|storefront|sell|seller|product|products)/.test(normalized)) {
    return {
      kind: "route",
      href: options.isProvider ? options.providerDefaultHref || "/dashboard/provider/add-service" : "/dashboard/people",
    };
  }

  return {
    kind: "route",
    href: options.defaultHref,
  };
};
