export const ACTIVECAMPAIGN_MODULE = {
  id: 'activecampaign',
  name: 'Active Campaign',
  description: 'Email marketing, automations, and nurture sequences. Tracks campaign performance and subscriber engagement.',
  docsUrl: 'https://help.activecampaign.com/hc/en-us/articles/207317590-Getting-started-with-the-API',
  editable: true,
  vars: [
    { key: 'ACTIVECAMPAIGN_API_URL', label: 'API URL', hint: 'Your account URL, e.g. https://youraccountname.api-us1.com' },
    { key: 'ACTIVECAMPAIGN_API_KEY', label: 'API Key', hint: 'Active Campaign → Settings → Developer → API Access → Key' },
  ],
}
