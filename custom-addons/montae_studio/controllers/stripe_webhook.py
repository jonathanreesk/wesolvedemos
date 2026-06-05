import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class MontaeStripeWebhook(http.Controller):

    @http.route('/stripe/webhook', auth='public', type='http', methods=['POST'], csrf=False)
    def stripe_webhook(self, **kwargs):
        """
        Handle Stripe webhook events.
        TODO: Verify webhook signature using montae.stripe_webhook_secret param.
        """
        payload = request.httprequest.data
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return request.make_response('Bad request', status=400)

        event_type = event.get('type', '')
        _logger.info('Stripe webhook received: %s', event_type)

        if event_type == 'customer.subscription.created':
            self._handle_subscription_created(event['data']['object'])
        elif event_type == 'customer.subscription.deleted':
            self._handle_subscription_deleted(event['data']['object'])
        elif event_type == 'invoice.payment_succeeded':
            self._handle_payment_succeeded(event['data']['object'])
        elif event_type == 'invoice.payment_failed':
            self._handle_payment_failed(event['data']['object'])

        return request.make_response('OK', status=200)

    def _handle_subscription_created(self, stripe_sub):
        sub = request.env['montae.subscription'].sudo().search([
            ('stripe_subscription_id', '=', stripe_sub['id'])
        ], limit=1)
        if sub:
            sub.action_activate()

    def _handle_subscription_deleted(self, stripe_sub):
        sub = request.env['montae.subscription'].sudo().search([
            ('stripe_subscription_id', '=', stripe_sub['id'])
        ], limit=1)
        if sub:
            sub.state = 'cancelled'

    def _handle_payment_succeeded(self, invoice):
        stripe_sub_id = invoice.get('subscription')
        if not stripe_sub_id:
            return
        sub = request.env['montae.subscription'].sudo().search([
            ('stripe_subscription_id', '=', stripe_sub_id)
        ], limit=1)
        if sub:
            sub._grant_credits()

    def _handle_payment_failed(self, invoice):
        stripe_sub_id = invoice.get('subscription')
        if not stripe_sub_id:
            return
        sub = request.env['montae.subscription'].sudo().search([
            ('stripe_subscription_id', '=', stripe_sub_id)
        ], limit=1)
        if sub:
            sub.state = 'paused'
            _logger.warning('Payment failed for subscription %s — paused', sub.id)
