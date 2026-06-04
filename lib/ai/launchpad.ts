import { generate } from "./provider";
import { z } from "zod";

export type LaunchpadInput = {
  businessName: string;
  businessType: "individual" | "shop" | "workshop";
  category: string;
  description: string;
  services: string[];
  pricingModel: "fixed" | "hourly" | "range";
  location: string;
  serviceRadius: number;
  hours: string;
  phone: string;
  brandTone: "professional" | "friendly" | "expert" | "humble";
};

export type LaunchpadOutput = {
  bio: string;
  serviceListings: {
    title: string;
    description: string;
    price: number;
    unit: string;
  }[];
  faq: { question: string; answer: string }[];
  tags: string[];
};

const launchpadOutputSchema = z.object({
  bio: z.string().min(10).max(500),
  serviceListings: z.array(
    z.object({
      title: z.string().min(3).max(100),
      description: z.string().min(10).max(300),
      price: z.number().nonnegative(),
      unit: z.string(),
    })
  ).min(1).max(8),
  faq: z.array(
    z.object({
      question: z.string().min(5).max(150),
      answer: z.string().min(10).max(300),
    })
  ).min(1).max(5),
  tags: z.array(z.string().min(2).max(30)).min(1).max(10),
});

export async function generateBusinessProfile(input: LaunchpadInput): Promise<LaunchpadOutput> {
  const servicesList = input.services.join(", ");

  return generate({
    prompt: `Generate a complete business profile for a local service provider on ServiQ marketplace.

Business details:
- Name: ${input.businessName}
- Type: ${input.businessType}
- Category: ${input.category}
- Description: ${input.description}
- Services: ${servicesList}
- Pricing model: ${input.pricingModel}
- Location: ${input.location}
- Service radius: ${input.serviceRadius} km
- Hours: ${input.hours}
- Brand tone: ${input.brandTone}

Generate:
1. A professional bio (100-200 words, in ${input.brandTone} tone, targeting local customers in ${input.location})
2. Service listings with realistic local prices (in INR, for ${input.location} area)
3. FAQ (3-5 common questions and answers for this service category)
4. Search tags (5-10 keywords for discoverability)`,
    schema: launchpadOutputSchema,
    system: "You are a business profile generator for ServiQ, a hyperlocal services marketplace. Generate content that helps small businesses in India go online. Use natural, local-appropriate language. Prices must be in INR and realistic for the specified location.",
  });
}
