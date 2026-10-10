// Offline: proves the webhook's signature path works in Deno (async SubtleCrypto)
// and that the old synchronous constructEvent would have thrown. No Stripe API calls.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe('sk_test_offline_placeholder', { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })
const provider = Stripe.createSubtleCryptoProvider()
const secret = 'whsec_offline_test_secret'
async function sign(body: string, key: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${body}`)))
  return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}
const payload = JSON.stringify({ id: 'evt_test', object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_test' } } })

Deno.test('async verification accepts a correctly signed payload', async () => {
  const header = await sign(payload, secret)
  const ev = await stripe.webhooks.constructEventAsync(payload, header, secret, undefined, provider)
  assertEquals(ev.type, 'checkout.session.completed')
})

Deno.test('async verification rejects a wrong secret and a tampered body', async () => {
  const header = await sign(payload, secret)
  await assertRejects(() => stripe.webhooks.constructEventAsync(payload, header, 'whsec_other', undefined, provider))
  await assertRejects(() => stripe.webhooks.constructEventAsync(payload.replace('cs_test', 'cs_evil'), header, secret, undefined, provider))
})

Deno.test('the old synchronous constructEvent cannot work in Deno', async () => {
  const header = await sign(payload, secret)
  let threw = false
  try { stripe.webhooks.constructEvent(payload, header, secret) } catch { threw = true }
  assert(threw)
})
