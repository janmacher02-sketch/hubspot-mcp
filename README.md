# HubSpot CRM MCP Server

MCP server for HubSpot CRM. Works with Claude Desktop, Cursor, and any MCP-compatible AI assistant.

## Tools

| Tool | Description |
|------|-------------|
| `search_contacts` | Search contacts by name, email, company, or any property |
| `get_contact` | Full contact details with associated deals and companies |
| `search_deals` | Search deals by name, amount, stage, or any property |
| `get_deal` | Full deal details with associated contacts and companies |
| `get_pipelines` | List all deal pipelines and their stages with probabilities |
| `search_companies` | Search companies by name, domain, industry |
| `get_recent_engagements` | Recent activities — emails, calls, meetings, notes |
| `get_owners` | List all HubSpot owners (sales reps, team members) |

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/hubspot-mcp/src/index.ts"],
      "env": {
        "HUBSPOT_API_KEY": "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

## Setup

1. Go to **HubSpot Settings → Integrations → Private Apps**
2. Create a new private app
3. Grant scopes: `crm.objects.contacts.read`, `crm.objects.deals.read`, `crm.objects.companies.read`, `crm.objects.owners.read`
4. Copy the access token and set as `HUBSPOT_API_KEY`

## Example Prompts

```
Search for contacts at Acme Corp
Show me all deals closing this month
What's our sales pipeline look like?
Get recent activity for contact ID 12345
List all sales reps in HubSpot
```

## Requirements

- Node.js 18+
- HubSpot Private App access token (free HubSpot account works)

## Pricing

| Tier | Limit | Price |
|------|-------|-------|
| Free | 10 calls/day | $0 |
| Pro | Unlimited | $29/month |

## License

MIT
