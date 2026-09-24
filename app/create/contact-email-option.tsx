"use client";
import { useEffect } from "react";

export default function ContactEmailOption() {
  useEffect(() => {
    const form = document.querySelector("form");
    const submit = form?.querySelector("button[type=submit]");
    if (!form || !submit || form.querySelector("[data-contact-email-option]")) return;
    let visible = false;
    const wrapper = document.createElement("label");
    wrapper.dataset.contactEmailOption = "true";
    wrapper.className = "block rounded-lg border border-black/10 bg-white p-4";
    wrapper.innerHTML = '<span class="flex items-start gap-3"><input type="checkbox" class="mt-1 h-4 w-4 accent-black" /><span><b class="block text-sm">公开联系邮箱</b><span class="mt-1 block text-xs leading-5 text-black/50">开启后，产品详情页会显示联系入口，方便别人向你请教。使用你的注册邮箱，不需要重复填写。</span></span></span>';
    const checkbox = wrapper.querySelector("input") as HTMLInputElement;
    checkbox.addEventListener("change", () => { visible = checkbox.checked; });
    form.insertBefore(wrapper, submit);
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/creations") && init?.method === "POST" && typeof init.body === "string") {
        try { const body = JSON.parse(init.body); body.contactEmailVisible = visible; init = { ...init, body: JSON.stringify(body) }; } catch {}
      }
      return originalFetch(input, init);
    };
    return () => { wrapper.remove(); window.fetch = originalFetch; };
  }, []);
  return null;
}
