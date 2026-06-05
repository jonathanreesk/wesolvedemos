from odoo import models, fields


class MontaePlan(models.Model):
    _name = 'montae.plan'
    _description = 'Montae Membership Plan'
    _order = 'price'

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    description = fields.Text()
    price = fields.Monetary(currency_field='currency_id', required=True)
    currency_id = fields.Many2one('res.currency', default=lambda s: s.env.ref('base.USD'))
    billing_period = fields.Selection([
        ('monthly', 'Monthly'),
        ('annual', 'Annual'),
    ], default='monthly', required=True)
    session_credits = fields.Integer(
        default=0,
        help='Credits granted per billing cycle (0 = unlimited)',
    )
    stripe_price_id = fields.Char(help='Stripe Price ID for recurring billing')
    active = fields.Boolean(default=True)
    subscription_ids = fields.One2many('montae.subscription', 'plan_id')
