import json
import logging
from datetime import datetime, timedelta

from odoo import http, fields
from odoo.http import request

_logger = logging.getLogger(__name__)


class MontaePortal(http.Controller):

    # ── Home / Landing ────────────────────────────────────────────────────────

    @http.route('/studio', auth='public', website=True)
    def studio_home(self, **kwargs):
        plans = request.env['montae.plan'].sudo().search([('active', '=', True)])
        return request.render('montae_studio.portal_home', {'plans': plans})

    # ── Booking flow ──────────────────────────────────────────────────────────

    @http.route('/studio/book', auth='user', website=True)
    def studio_book(self, date=None, **kwargs):
        resources = request.env['montae.resource'].sudo().search([('active', '=', True)])
        return request.render('montae_studio.portal_book', {
            'resources': resources,
            'preselect_date': date or '',
        })

    @http.route('/studio/book/slots', auth='user', type='json')
    def studio_book_slots(self, resource_id, date, **kwargs):
        resource = request.env['montae.resource'].sudo().browse(int(resource_id))
        if not resource.exists():
            return {'error': 'Resource not found'}
        day = datetime.strptime(date, '%Y-%m-%d').date()
        existing = request.env['montae.booking'].sudo().search([
            ('resource_id', '=', resource.id),
            ('datetime_start', '>=', datetime.combine(day, datetime.min.time())),
            ('datetime_start', '<', datetime.combine(day + timedelta(days=1), datetime.min.time())),
            ('state', 'not in', ['cancelled']),
        ])
        booked_slots = [(b.datetime_start.hour * 60 + b.datetime_start.minute) for b in existing]
        open_h = int(resource.open_time)
        close_h = int(resource.close_time)
        slots = []
        for h in range(open_h, close_h):
            for m in [0, 30]:
                slot_minutes = h * 60 + m
                slots.append({
                    'time': f'{h:02d}:{m:02d}',
                    'available': slot_minutes not in booked_slots,
                })
        return {'slots': slots}

    @http.route('/studio/book/confirm', auth='user', type='json')
    def studio_book_confirm(self, resource_id, session_type, datetime_start, duration=60, **kwargs):
        partner = request.env.user.partner_id
        dt_start = datetime.fromisoformat(datetime_start)
        dt_end = dt_start + timedelta(minutes=int(duration))
        sub = partner.montae_active_subscription_id
        booking = request.env['montae.booking'].sudo().create({
            'partner_id': partner.id,
            'subscription_id': sub.id if sub else False,
            'resource_id': int(resource_id),
            'session_type': session_type,
            'datetime_start': dt_start,
            'datetime_end': dt_end,
        })
        if sub and sub.plan_id.session_credits > 0:
            sub.credit_balance -= booking.credits_used
            request.env['montae.credit.log'].sudo().create({
                'subscription_id': sub.id,
                'partner_id': partner.id,
                'delta': -booking.credits_used,
                'reason': 'session_used',
                'booking_id': booking.id,
                'note': f'Session booked: {session_type}',
            })
        return {'booking_id': booking.id, 'status': 'confirmed'}

    # ── Account ───────────────────────────────────────────────────────────────

    @http.route('/studio/account', auth='user', website=True)
    def studio_account(self, tab='subscription', **kwargs):
        partner = request.env.user.partner_id
        subscription = partner.montae_active_subscription_id
        bookings = request.env['montae.booking'].sudo().search([
            ('partner_id', '=', partner.id),
        ], order='datetime_start desc', limit=50)
        plans = request.env['montae.plan'].sudo().search([('active', '=', True)])
        return request.render('montae_studio.portal_account', {
            'partner': partner,
            'subscription': subscription,
            'bookings': bookings,
            'plans': plans,
            'active_tab': tab,
        })

    @http.route('/studio/account/cancel-booking', auth='user', type='json')
    def cancel_booking(self, booking_id, **kwargs):
        booking = request.env['montae.booking'].sudo().browse(int(booking_id))
        if not booking.exists() or booking.partner_id != request.env.user.partner_id:
            return {'error': 'Not found'}
        if booking.state not in ('confirmed',):
            return {'error': 'Cannot cancel this booking'}
        booking.action_cancel()
        sub = booking.subscription_id
        if sub and sub.plan_id.session_credits > 0:
            sub.credit_balance += booking.credits_used
            request.env['montae.credit.log'].sudo().create({
                'subscription_id': sub.id,
                'partner_id': booking.partner_id.id,
                'delta': booking.credits_used,
                'reason': 'refund',
                'booking_id': booking.id,
                'note': 'Booking cancelled — credits refunded',
            })
        return {'status': 'cancelled'}

    @http.route('/studio/account/bookings', auth='user', type='json')
    def account_bookings_json(self, **kwargs):
        """Return bookings as JSON for the client calendar JS."""
        partner = request.env.user.partner_id
        bookings = request.env['montae.booking'].sudo().search([
            ('partner_id', '=', partner.id),
            ('state', 'not in', ['cancelled']),
        ])
        result = []
        for b in bookings:
            result.append({
                'id': b.id,
                'title': b.session_type,
                'resource': b.resource_id.name,
                'start': b.datetime_start.isoformat() if b.datetime_start else None,
                'end': b.datetime_end.isoformat() if b.datetime_end else None,
                'state': b.state,
            })
        return result

    # ── Stripe integration ────────────────────────────────────────────────────

    @http.route('/studio/subscribe', auth='user', type='json')
    def studio_subscribe(self, plan_id, **kwargs):
        """
        TODO: Integrate Stripe Checkout Session creation here.
        1. Load stripe secret key from ir.config_parameter 'montae.stripe_secret_key'
        2. Create stripe.checkout.Session with the plan's stripe_price_id
        3. Return {'checkout_url': session.url}
        """
        plan = request.env['montae.plan'].sudo().browse(int(plan_id))
        if not plan.exists():
            return {'error': 'Plan not found'}
        return {'error': 'Stripe not yet configured — add stripe_price_id to the plan and configure API keys'}
