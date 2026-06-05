import json
import logging
from datetime import datetime, timedelta

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

STAFF_GROUP = 'montae_studio.group_montae_staff'


class MontaeStaffCalendar(http.Controller):

    @http.route('/studio/staff/calendar', auth='user', website=True, sitemap=False)
    def staff_calendar(self, date=None, **kwargs):
        if not request.env.user.has_group(STAFF_GROUP):
            return request.redirect('/studio')
        if date:
            try:
                day = datetime.strptime(date, '%Y-%m-%d').date()
            except ValueError:
                day = datetime.today().date()
        else:
            day = datetime.today().date()
        resources = request.env['montae.resource'].sudo().search([('active', '=', True)])
        return request.render('montae_studio.staff_calendar', {
            'resources': resources,
            'current_date': day.isoformat(),
            'prev_date': (day - timedelta(days=1)).isoformat(),
            'next_date': (day + timedelta(days=1)).isoformat(),
            'today': datetime.today().date().isoformat(),
            'day_label': day.strftime('%A, %d %B %Y'),
        })

    @http.route('/studio/staff/calendar/bookings', auth='user', type='json')
    def staff_calendar_bookings(self, date, **kwargs):
        if not request.env.user.has_group(STAFF_GROUP):
            return {'error': 'Access denied'}
        day = datetime.strptime(date, '%Y-%m-%d').date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        bookings = request.env['montae.booking'].sudo().search([
            ('datetime_start', '>=', day_start),
            ('datetime_start', '<', day_end),
        ])
        result = []
        for b in bookings:
            result.append({
                'id': b.id,
                'client': b.partner_id.name,
                'client_id': b.partner_id.id,
                'session_type': b.session_type,
                'resource_id': b.resource_id.id,
                'start': b.datetime_start.isoformat(),
                'end': b.datetime_end.isoformat(),
                'state': b.state,
                'notes': b.notes or '',
                'credits_used': b.credits_used,
            })
        return result

    @http.route('/studio/staff/book', auth='user', type='json')
    def staff_book(self, resource_id, partner_id, session_type, datetime_start, duration=60, notes='', **kwargs):
        if not request.env.user.has_group(STAFF_GROUP):
            return {'error': 'Access denied'}
        dt_start = datetime.fromisoformat(datetime_start)
        dt_end = dt_start + timedelta(minutes=int(duration))
        partner = request.env['res.partner'].sudo().browse(int(partner_id))
        if not partner.exists():
            return {'error': 'Client not found'}
        sub = partner.montae_active_subscription_id
        booking = request.env['montae.booking'].sudo().create({
            'partner_id': partner.id,
            'subscription_id': sub.id if sub else False,
            'resource_id': int(resource_id),
            'session_type': session_type,
            'datetime_start': dt_start,
            'datetime_end': dt_end,
            'notes': notes,
        })
        return {
            'booking_id': booking.id,
            'client': partner.name,
            'status': 'confirmed',
        }

    @http.route('/studio/staff/booking/<int:booking_id>/checkin', auth='user', type='json')
    def staff_checkin(self, booking_id, **kwargs):
        if not request.env.user.has_group(STAFF_GROUP):
            return {'error': 'Access denied'}
        booking = request.env['montae.booking'].sudo().browse(booking_id)
        if not booking.exists():
            return {'error': 'Not found'}
        if booking.state != 'confirmed':
            return {'error': f'Cannot check in — booking is {booking.state}'}
        booking.action_check_in()
        return {'status': 'checked_in'}

    @http.route('/studio/staff/booking/<int:booking_id>/cancel', auth='user', type='json')
    def staff_cancel(self, booking_id, **kwargs):
        if not request.env.user.has_group(STAFF_GROUP):
            return {'error': 'Access denied'}
        booking = request.env['montae.booking'].sudo().browse(booking_id)
        if not booking.exists():
            return {'error': 'Not found'}
        if booking.state not in ('confirmed', 'checked_in'):
            return {'error': f'Cannot cancel — booking is {booking.state}'}
        booking.action_cancel()
        return {'status': 'cancelled'}

    @http.route('/studio/staff/clients/search', auth='user', type='json')
    def staff_client_search(self, query, **kwargs):
        if not request.env.user.has_group(STAFF_GROUP):
            return {'error': 'Access denied'}
        domain = [
            '|',
            ('name', 'ilike', query),
            ('email', 'ilike', query),
        ]
        partners = request.env['res.partner'].sudo().search(domain, limit=20)
        return [{'id': p.id, 'name': p.name, 'email': p.email or ''} for p in partners]
