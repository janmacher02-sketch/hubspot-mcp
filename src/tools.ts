import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HUBSPOT_API = "https://api.hubapi.com";

function getApiKey(): string {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) throw new Error("HUBSPOT_API_KEY environment variable is required. Get it from Settings → Integrations → Private Apps in HubSpot.");
  return key;
}

async function hubspotFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Register all tools on a McpServer instance ───────────────────────────────

export function registerTools(server: McpServer) {

  // ── Search Contacts ─────────────────────────────────────────────────────────

  server.tool(
    "search_contacts",
    "Search HubSpot contacts by name, email, company, or any property. Returns up to 10 matching contacts with key details.",
    {
      query: z.string().describe("Search term — name, email, company name, phone number, etc."),
      limit: z.number().min(1).max(100).default(10).describe("Number of results to return (default: 10, max: 100)"),
    },
    async ({ query, limit }) => {
      const data = await hubspotFetch("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit,
          properties: ["firstname", "lastname", "email", "company", "phone", "lifecyclestage", "hs_lead_status", "createdate"],
        }),
      });

      if (!data.results?.length) {
        return { content: [{ type: "text", text: `No contacts found matching "${query}".` }] };
      }

      let text = `**Found ${data.total} contacts** (showing ${data.results.length}):\n\n`;
      for (const c of data.results) {
        const p = c.properties;
        text += `---\n`;
        text += `**${p.firstname ?? ""} ${p.lastname ?? ""}**.trim() || "(No name)"\n`;
        text += `Email: ${p.email ?? "—"}\n`;
        text += `Company: ${p.company ?? "—"}\n`;
        text += `Phone: ${p.phone ?? "—"}\n`;
        text += `Stage: ${p.lifecyclestage ?? "—"}\n`;
        text += `Lead Status: ${p.hs_lead_status ?? "—"}\n`;
        text += `Created: ${p.createdate?.split("T")[0] ?? "—"}\n`;
        text += `ID: ${c.id}\n\n`;
      }
      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get Contact Details ─────────────────────────────────────────────────────

  server.tool(
    "get_contact",
    "Get full details of a HubSpot contact by ID. Includes all properties, associated deals, and recent activity.",
    { contact_id: z.string().describe("HubSpot contact ID") },
    async ({ contact_id }) => {
      const data = await hubspotFetch(
        `/crm/v3/objects/contacts/${contact_id}?associations=deals,companies&propertiesWithHistory=firstname,lastname,email,company,phone,lifecyclestage,hs_lead_status,jobtitle,city,state,country,notes_last_updated,hs_last_sales_activity_timestamp`
      );

      const p = data.properties;
      let text = `**Contact: ${p.firstname ?? ""} ${p.lastname ?? ""}**\n\n`;
      text += `| Property | Value |\n|----------|-------|\n`;
      text += `| Email | ${p.email ?? "—"} |\n`;
      text += `| Phone | ${p.phone ?? "—"} |\n`;
      text += `| Company | ${p.company ?? "—"} |\n`;
      text += `| Job Title | ${p.jobtitle ?? "—"} |\n`;
      text += `| Location | ${[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"} |\n`;
      text += `| Lifecycle Stage | ${p.lifecyclestage ?? "—"} |\n`;
      text += `| Lead Status | ${p.hs_lead_status ?? "—"} |\n`;
      text += `| Last Activity | ${p.hs_last_sales_activity_timestamp?.split("T")[0] ?? "—"} |\n`;

      if (data.associations?.deals?.results?.length) {
        text += `\n**Associated Deals:** ${data.associations.deals.results.length}\n`;
        for (const d of data.associations.deals.results) {
          text += `• Deal ID: ${d.id}\n`;
        }
      }

      return { content: [{ type: "text", text }] };
    }
  );

  // ── Search Deals ────────────────────────────────────────────────────────────

  server.tool(
    "search_deals",
    "Search HubSpot deals by name, amount, stage, or any property. Returns pipeline details and deal values.",
    {
      query: z.string().describe("Search term — deal name, company, amount, etc."),
      limit: z.number().min(1).max(100).default(10).describe("Number of results (default: 10)"),
    },
    async ({ query, limit }) => {
      const data = await hubspotFetch("/crm/v3/objects/deals/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit,
          properties: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hubspot_owner_id", "createdate", "hs_lastmodifieddate"],
        }),
      });

      if (!data.results?.length) {
        return { content: [{ type: "text", text: `No deals found matching "${query}".` }] };
      }

      let text = `**Found ${data.total} deals** (showing ${data.results.length}):\n\n`;
      for (const d of data.results) {
        const p = d.properties;
        text += `---\n`;
        text += `**${p.dealname ?? "(Unnamed deal)"}**\n`;
        text += `Amount: ${p.amount ? `$${Number(p.amount).toLocaleString()}` : "—"}\n`;
        text += `Stage: ${p.dealstage ?? "—"}\n`;
        text += `Pipeline: ${p.pipeline ?? "—"}\n`;
        text += `Close Date: ${p.closedate?.split("T")[0] ?? "—"}\n`;
        text += `Created: ${p.createdate?.split("T")[0] ?? "—"}\n`;
        text += `ID: ${d.id}\n\n`;
      }
      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get Deal Details ────────────────────────────────────────────────────────

  server.tool(
    "get_deal",
    "Get full details of a HubSpot deal by ID, including associated contacts and companies.",
    { deal_id: z.string().describe("HubSpot deal ID") },
    async ({ deal_id }) => {
      const data = await hubspotFetch(
        `/crm/v3/objects/deals/${deal_id}?associations=contacts,companies&properties=dealname,amount,dealstage,pipeline,closedate,hubspot_owner_id,createdate,description,hs_lastmodifieddate,num_associated_contacts`
      );

      const p = data.properties;
      let text = `**Deal: ${p.dealname}**\n\n`;
      text += `| Property | Value |\n|----------|-------|\n`;
      text += `| Amount | ${p.amount ? `$${Number(p.amount).toLocaleString()}` : "—"} |\n`;
      text += `| Stage | ${p.dealstage ?? "—"} |\n`;
      text += `| Pipeline | ${p.pipeline ?? "—"} |\n`;
      text += `| Close Date | ${p.closedate?.split("T")[0] ?? "—"} |\n`;
      text += `| Created | ${p.createdate?.split("T")[0] ?? "—"} |\n`;
      text += `| Description | ${p.description ?? "—"} |\n`;
      text += `| # Contacts | ${p.num_associated_contacts ?? "—"} |\n`;

      if (data.associations?.contacts?.results?.length) {
        text += `\n**Associated Contacts:**\n`;
        for (const c of data.associations.contacts.results) {
          text += `• Contact ID: ${c.id}\n`;
        }
      }
      if (data.associations?.companies?.results?.length) {
        text += `\n**Associated Companies:**\n`;
        for (const c of data.associations.companies.results) {
          text += `• Company ID: ${c.id}\n`;
        }
      }

      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get Pipeline Overview ───────────────────────────────────────────────────

  server.tool(
    "get_pipelines",
    "Get all deal pipelines and their stages from HubSpot. Shows stage names, display order, and probability for each pipeline.",
    {},
    async () => {
      const data = await hubspotFetch("/crm/v3/pipelines/deals");

      let text = `**Deal Pipelines (${data.results.length}):**\n\n`;
      for (const p of data.results) {
        text += `### ${p.label}\n`;
        text += `ID: ${p.id}\n`;
        text += `| Stage | ID | Probability | Order |\n|-------|-----|------------|-------|\n`;
        const stages = [...p.stages].sort((a: any, b: any) => a.displayOrder - b.displayOrder);
        for (const s of stages) {
          text += `| ${s.label} | ${s.id} | ${s.metadata?.probability ?? "—"}% | ${s.displayOrder} |\n`;
        }
        text += `\n`;
      }
      return { content: [{ type: "text", text }] };
    }
  );

  // ── Search Companies ────────────────────────────────────────────────────────

  server.tool(
    "search_companies",
    "Search HubSpot companies by name, domain, industry, or any property.",
    {
      query: z.string().describe("Search term — company name, domain, industry, etc."),
      limit: z.number().min(1).max(100).default(10).describe("Number of results (default: 10)"),
    },
    async ({ query, limit }) => {
      const data = await hubspotFetch("/crm/v3/objects/companies/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit,
          properties: ["name", "domain", "industry", "city", "state", "country", "numberofemployees", "annualrevenue", "createdate"],
        }),
      });

      if (!data.results?.length) {
        return { content: [{ type: "text", text: `No companies found matching "${query}".` }] };
      }

      let text = `**Found ${data.total} companies** (showing ${data.results.length}):\n\n`;
      for (const c of data.results) {
        const p = c.properties;
        text += `---\n`;
        text += `**${p.name ?? "(Unnamed)"}**\n`;
        text += `Domain: ${p.domain ?? "—"}\n`;
        text += `Industry: ${p.industry ?? "—"}\n`;
        text += `Location: ${[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"}\n`;
        text += `Employees: ${p.numberofemployees ?? "—"}\n`;
        text += `Revenue: ${p.annualrevenue ? `$${Number(p.annualrevenue).toLocaleString()}` : "—"}\n`;
        text += `ID: ${c.id}\n\n`;
      }
      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get Recent Activities ───────────────────────────────────────────────────

  server.tool(
    "get_recent_engagements",
    "Get recent activities/engagements (emails, calls, meetings, notes) from HubSpot. Useful for tracking team activity.",
    {
      limit: z.number().min(1).max(100).default(20).describe("Number of results (default: 20)"),
    },
    async ({ limit }) => {
      const data = await hubspotFetch(`/crm/v3/objects/engagements?limit=${limit}&properties=hs_engagement_type,hs_timestamp,hs_body_preview,hubspot_owner_id`);

      if (!data.results?.length) {
        return { content: [{ type: "text", text: "No recent engagements found." }] };
      }

      let text = `**Recent Engagements (${data.results.length}):**\n\n`;
      for (const e of data.results) {
        const p = e.properties;
        const date = p.hs_timestamp?.split("T")[0] ?? "—";
        const type = (p.hs_engagement_type ?? "unknown").toUpperCase();
        text += `• **[${type}]** ${date} — ${p.hs_body_preview?.slice(0, 120) ?? "(no preview)"}\n`;
      }
      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get Owners (Sales Reps) ─────────────────────────────────────────────────

  server.tool(
    "get_owners",
    "List all HubSpot owners (sales reps, team members). Useful for assigning contacts/deals or filtering by owner.",
    {},
    async () => {
      const data = await hubspotFetch("/crm/v3/owners");

      let text = `**HubSpot Owners (${data.results.length}):**\n\n`;
      text += `| Name | Email | ID |\n|------|-------|----|\n`;
      for (const o of data.results) {
        text += `| ${o.firstName ?? ""} ${o.lastName ?? ""} | ${o.email ?? "—"} | ${o.id} |\n`;
      }
      return { content: [{ type: "text", text }] };
    }
  );
}
