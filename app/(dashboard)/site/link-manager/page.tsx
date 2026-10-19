import { redirect } from "next/navigation";

export default function LegacyPage() {
  redirect("/site/settings/links");
}
