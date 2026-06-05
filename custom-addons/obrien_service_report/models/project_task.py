from odoo import models, api

class ProjectTask(models.Model):
    _inherit = 'project.task'

    def _compute_total_hours_spent(self):
        for task in self:
            task.total_hours_spent = sum(task.timesheet_ids.mapped('unit_amount'))
