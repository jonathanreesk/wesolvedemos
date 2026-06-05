from odoo import models, fields, api
from odoo.exceptions import ValidationError


class MontaeBooking(models.Model):
    _name = 'montae.booking'
    _description = 'Montae Session Booking'
    _order = 'datetime_start desc'
    _rec_name = 'display_name'

    name = fields.Char(default='New Booking')
    display_name = fields.Char(compute='_compute_display_name', store=True)
    partner_id = fields.Many2one('res.partner', required=True, ondelete='restrict')
    subscription_id = fields.Many2one('montae.subscription', ondelete='set null')
    resource_id = fields.Many2one('montae.resource', required=True, ondelete='restrict')
    session_type = fields.Char(required=True)
    datetime_start = fields.Datetime(required=True)
    datetime_end = fields.Datetime(required=True)
    duration = fields.Float(compute='_compute_duration', store=True)
    state = fields.Selection([
        ('confirmed', 'Confirmed'),
        ('checked_in', 'Checked In'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ], default='confirmed', required=True, tracking=True)
    notes = fields.Text()
    checkin_token = fields.Char(copy=False)
    addon_ids = fields.Many2many('montae.addon', string='Add-ons')
    credits_used = fields.Integer(default=1)

    @api.depends('partner_id', 'datetime_start', 'session_type')
    def _compute_display_name(self):
        for rec in self:
            dt = rec.datetime_start.strftime('%d %b %Y %H:%M') if rec.datetime_start else ''
            rec.display_name = f'{rec.partner_id.name or ""} — {rec.session_type or ""} @ {dt}'

    @api.depends('datetime_start', 'datetime_end')
    def _compute_duration(self):
        for rec in self:
            if rec.datetime_start and rec.datetime_end:
                delta = rec.datetime_end - rec.datetime_start
                rec.duration = delta.total_seconds() / 3600
            else:
                rec.duration = 0.0

    @api.constrains('datetime_start', 'datetime_end')
    def _check_dates(self):
        for rec in self:
            if rec.datetime_end <= rec.datetime_start:
                raise ValidationError('End time must be after start time.')

    def action_check_in(self):
        self.state = 'checked_in'

    def action_complete(self):
        self.state = 'completed'

    def action_cancel(self):
        self.state = 'cancelled'
