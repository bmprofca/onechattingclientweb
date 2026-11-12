import { buildWhatsAppMessage } from "./qrcode";

test("uses a widget prefill and appends campaign/source attribution", () => {
    const params = new URLSearchParams("message=Hello%20there&campaign=spring&source=website");
    expect(buildWhatsAppMessage("Default message", params)).toBe(
        "Hello there\n\nCampaign: spring | Source: website"
    );
});

test("keeps the default message and safely bounds attribution values", () => {
    const params = new URLSearchParams(`campaign=${"x".repeat(150)}&source=store%0AInjected`);
    const message = buildWhatsAppMessage("Default message", params);
    expect(message).toContain("Default message");
    expect(message).toContain(`Campaign: ${"x".repeat(100)}`);
    expect(message).toContain("Source: store Injected");
    expect(message).not.toContain("Injected\n");
    expect(buildWhatsAppMessage("x".repeat(520), new URLSearchParams())).toBe("x".repeat(500));
});
