import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "هم‌حساب — دفتر مالی شخصی",
    short_name: "هم‌حساب",
    description: "مدیریت بدهی، طلب، اقساط، چک‌ها و دُنگ‌های مشترک",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ea",
    theme_color: "#315d4c",
    lang: "fa",
    dir: "rtl",
  };
}
