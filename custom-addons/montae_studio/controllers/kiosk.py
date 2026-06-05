import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class MontaeKiosk(http.Controller):

    @http.route('/kiosk', auth='public', website=True, sitemap=False)
    def kiosk_home(self, **kwargs):
        return request.render('montae_studio.kiosk_home', {})

    @http.route('/kiosk/checkin', auth='public', type='json')
    def kiosk_checkin(self, booking_id=None, token=None, **kwargs):
        booking = None
        if booking_id and token:
            booking = request.env['montae.booking'].sudo().search([
                ('id', '=', int(booking_id)),
                ('checkin_token', '=', token),
            ], limit=1)
        elif token:
            booking = request.env['montae.booking'].sudo().search([
                ('checkin_token', '=', token),
                ('state', '=', 'confirmed'),
            ], limit=1)

        if not booking:
            return {'error': 'Booking not found or already checked in'}
        if booking.state != 'confirmed':
            return {'error': f'Booking is {booking.state}'}

        booking.action_check_in()
        return {
            'status': 'checked_in',
            'client': booking.partner_id.name,
            'session': booking.session_type,
            'resource': booking.resource_id.name,
        }

    @http.route('/kiosk/lookup', auth='public', type='json')
    def kiosk_lookup(self, query, **kwargs):
        """Search bookings by client name or email for walk-in check-in."""
        domain = [
            ('state', '=', 'confirmed'),
            '|',
            ('partner_id.name', 'ilike', query),
            ('partner_id.email', 'ilike', query),
        ]
        bookings = request.env['montae.booking'].sudo().search(domain, limit=10)
        return [{
            'id': b.id,
            'client': b.partner_id.name,
            'session': b.session_type,
            'resource': b.resource_id.name,
            'time': b.datetime_start.strftime('%H:%M') if b.datetime_start else '',
            'token': b.checkin_token or '',
        } for b in bookings]
