from odoo import models, fields


class MontaeAddon(models.Model):
    _name = 'montae.addon'
    _description = 'Montae Session Add-on'
    _order = 'name'

    name = fields.Char(required=True)
    description = fields.Text()
    price = fields.Monetary(currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', default=lambda s: s.env.ref('base.USD'))
    active = fields.Boolean(default=True)
