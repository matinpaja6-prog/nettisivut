"use client";

import NextLink from "next/link";
import { forwardRef, useContext, type ComponentProps } from "react";
import { localizeHref } from "@/lib/routes";
import { LanguageContext } from "./LanguageProvider";

const LocalizedLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function LocalizedLink({ href, ...props }, ref) {
  const { locale } = useContext(LanguageContext);
  const localizedHref = typeof href === "string" ? localizeHref(href, locale) : {
    ...href, pathname: href.pathname ? localizeHref(href.pathname, locale) : href.pathname
  };
  return <NextLink prefetch={false} {...props} href={localizedHref} ref={ref} />;
});

export default LocalizedLink;
