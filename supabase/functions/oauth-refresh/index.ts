// Supabase Edge Function: oauth-refresh
// Refreshes OAuth access tokens for integration providers (Gusto, DocuSign, QuickBooks, ADP)
// Deploy with: supabase functions deploy oauth-refresh
//
// Called by a cron job or on-demand when a token is about to expire.
// POST body: { companyId: string, provider: "gusto" | "docusign" | "quickbooks" | "adp" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { getCorsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Provider OAuth endpoints
const OAUTH_ENDPOINTS: Record<string, { tokenUrl: string; extraHeaders?: Record<string, string> }> = {
  gusto: {
    tokenUrl: 'https://api.gusto.com/oauth/token',
  },
  docusign: {
    tokenUrl: 'https://account-d.docusign.com/oauth/token',
  },
  quickbooks: {
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  },
  adp: {
    tokenUrl: 'https://api.adp.com/auth/oauth/v2/token',
  },
}

interface RefreshRequest {
  companyId: string
  provider: 'gusto' | 'docusign' | 'quickbooks' | 'adp'
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { companyId, provider } = (await req.json()) as RefreshRequest

    if (!companyId || !provider) {
      return new Response(
        JSON.stringify({ error: 'Missing companyId or provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const endpoint = OAUTH_ENDPOINTS[provider]
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read current integration config
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: config, error: configError } = await supabase
      .from('integrations_config')
      .select('id, config')
      .eq('company_id', companyId)
      .eq('provider', provider)
      .eq('is_active', true)
      .maybeSingle()

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: `No active ${provider} integration found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cfg = config.config as Record<string, string>
    const clientId = cfg.client_id
    const refreshToken = cfg.refresh_token

    if (!clientId || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Missing client_id or refresh_token in config' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the token refresh request
    // Most OAuth providers accept standard form-urlencoded body
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    })

    // Some providers need client_secret in the body
    if (cfg.client_app_secret) {
      body.set('client_secret', cfg.client_app_secret)
    }

    // QuickBooks uses Basic auth header instead of body params
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    if (provider === 'quickbooks' && cfg.client_app_secret) {
      headers['Authorization'] = `Basic ${btoa(`${clientId}:${cfg.client_app_secret}`)}`
    }

    // Exchange refresh token for new access token
    const tokenRes = await fetch(endpoint.tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error(`[oauth-refresh] ${provider} token refresh failed (${tokenRes.status}):`, err)
      return new Response(
        JSON.stringify({ error: `Token refresh failed: ${tokenRes.status}`, detail: err }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenRes.json()
    const newAccessToken = tokenData.access_token
    const newRefreshToken = tokenData.refresh_token ?? refreshToken // Some providers rotate refresh tokens

    if (!newAccessToken) {
      return new Response(
        JSON.stringify({ error: 'No access_token in provider response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the integration config with the new tokens
    // client_secret stores the access_token (per the convention in gusto-service.ts)
    const updatedConfig = {
      ...cfg,
      client_secret: newAccessToken,
      refresh_token: newRefreshToken,
      token_refreshed_at: new Date().toISOString(),
      token_expires_in: tokenData.expires_in ?? null,
    }

    const { error: updateError } = await supabase
      .from('integrations_config')
      .update({ config: updatedConfig })
      .eq('id', config.id)

    if (updateError) {
      console.error('[oauth-refresh] Failed to update config:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to persist refreshed token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[oauth-refresh] Successfully refreshed ${provider} token for company ${companyId}`)

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        expiresIn: tokenData.expires_in ?? null,
        refreshedAt: updatedConfig.token_refreshed_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[oauth-refresh] Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
