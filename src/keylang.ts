import keylangMap from "@/data/keylang.json";
import keylangApifyMap from "@/data/keylang_apify.json";

const keylang = keylangMap as Record<string, string>;
const keylangApify = keylangApifyMap as Record<string, string>;

export function langkey(value: string): string {
  return keylang[value] ?? value;
}

export function langkeyApify(value: string): string {
  return keylangApify[value] ?? value;
}
