from odoo import models, fields, api
from dateutil.relativedelta import relativedelta


class MontaeSubscription(models.Model):
    _name = 'montae.subscription'
    _description = 'Montae Membership Subscription'
    _order = 'date_start desc'

    name = fields.Char(compute='_compute_name', store=True)
    partner_id = fields.Many2one('res.partner', required=True, ondelete='restrict')
    plan_id = fields.Many2one('montae.plan', required=True, ondelete='restrict')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ], default='draft', required=True, tracking=True)
    date_start = fields.Date(default=fields.Date.today)
    date_end = fields.Date()
    next_billing_date = fields.Date()
    stripe_subscription_id = fields.Char()
    stripe_customer_id = fields.Char()
    credit_balance = fields.Integer(default=0)
    booking_ids = fields.One2many('montae.booking', 'subscription_id')
    credit_log_ids = fields.One2many('montae.credit.log', 'subscription_id')

    @api.depends('partner_id', 'plan_id')
    def _compute_name(self):
        for rec in self:
            rec.name = f'{rec.partner_id.name or ""} — {rec.plan_id.name or ""}'

    def action_activate(self):
        for rec in self:
            rec.state = 'active'
            if rec.plan_id.billing_period == 'monthly':
                rec.next_billing_date = rec.date_start + relativedelta(months=1)
            else:
                rec.next_billing_date = rec.date_start + relativedelta(years=1)
            rec._grant_credits()

    def _grant_credits(self):
        for rec in self:
            credits = rec.plan_id.session_credits
            if credits > 0:
                rec.credit_balance += credits
                self.env['montae.credit.log'].create({
                    'subscription_id': rec.id,
                    'partner_id': rec.partner_id.id,
                    'delta': credits,
                    'reason': 'billing_cycle',
                    'note': f'Credits granted for {rec.plan_id.name}',
                })
