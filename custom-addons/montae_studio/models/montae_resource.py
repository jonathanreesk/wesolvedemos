from odoo import models, fields


class MontaeResource(models.Model):
    _name = 'montae.resource'
    _description = 'Montae Studio Resource'
    _order = 'sequence, name'

    name = fields.Char(required=True)
    resource_type = fields.Selection([
        ('station', 'Station'),
        ('practitioner', 'Practitioner'),
    ], required=True, default='station')
    description = fields.Text()
    capacity = fields.Integer(default=1)
    open_time = fields.Float(default=7.0, help='Opening time (24h float, e.g. 7.0 = 07:00)')
    close_time = fields.Float(default=19.0, help='Closing time (24h float)')
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    color = fields.Integer(default=0)
    booking_ids = fields.One2many('montae.booking', 'resource_id')
