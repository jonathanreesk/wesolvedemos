from odoo import models, fields


class ResPartner(models.Model):
    _inherit = 'res.partner'

    montae_subscription_ids = fields.One2many('montae.subscription', 'partner_id', string='Studio Subscriptions')
    montae_booking_ids = fields.One2many('montae.booking', 'partner_id', string='Studio Bookings')
    montae_active_subscription_id = fields.Many2one(
        'montae.subscription',
        compute='_compute_active_subscription',
        string='Active Studio Subscription',
    )
    montae_member = fields.Boolean(compute='_compute_active_subscription', store=False)

    def _compute_active_subscription(self):
        for partner in self:
            active = partner.montae_subscription_ids.filtered(lambda s: s.state == 'active')
            partner.montae_active_subscription_id = active[:1]
            partner.montae_member = bool(active)
