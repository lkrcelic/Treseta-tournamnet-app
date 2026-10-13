import {NotFoundMessage} from "@/app/_ui/sp/PageMessage";

// Any address the app doesn't have, and a page's own notFound(): in Croatian instead of Next's "404: This page could not
// be found.", the tab's title too (PageMessage)
export default function NotFound() {
  return <NotFoundMessage />;
}
