import { NextRequest, NextResponse } from "next/server";
import { listServices } from "@/lib/portal-store/operations";
import { clientIp, rateLimit, rateLimitedResponse } from "@/lib/security";

export async function GET(req: NextRequest) {
  if (!rateLimit(`services-get:${clientIp(req)}`, 60)) return rateLimitedResponse();
  const services = await listServices(true);
  return NextResponse.json({
    services: services.map((service) => ({
      id: service.id,
      type: service.consultancyType,
      kicker: service.kicker,
      title: service.title,
      detail: service.detail,
    })),
  });
}
