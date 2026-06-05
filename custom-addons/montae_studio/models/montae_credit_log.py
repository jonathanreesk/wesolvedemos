from odoo import models, fields


class MontaeCreditLog(models.Model):
    _name = 'montae.credit.log'
    _description = 'Montae Credit Log'
    _order = 'create_date desc'

    subscription_id = fields.Many2one('montae.subscription', ondelete='cascade', required=True)
    partner_id = fields.Many2one('res.partner', required=True)
    delta = fields.Integer(required=True, help='Positive = credit granted, negative = credit used')
    reason = fields.Selection([
        ('billing_cycle', 'Billing Cycle'),
        ('session_used', 'Session Used'),
        ('manual_adjust', 'Manual Adjustment'),
        ('refund', 'Refund'),
    ], required=True)
    note = fields.Char()
    booking_id = fields.Many2one('montae.booking')
