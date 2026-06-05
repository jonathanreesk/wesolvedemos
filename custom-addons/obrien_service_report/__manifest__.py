{
    'name': "O'Brien Analytical - Service Report",
    'version': '19.0.1.0.0',
    'summary': "Branded field service report",
    'author': 'WeSolve Corp',
    'license': 'LGPL-3',
    'depends': ['industry_fsm', 'project', 'hr_timesheet'],
    'data': [
        'report/fsm_service_report.xml',
        'report/report_actions.xml',
    ],
    'installable': True,
    'auto_install': False,
}
