import os
import sys

#apache_configuration = os.path.dirname(__file__)
#project = os.path.dirname(apache_configuration)
#workspace = os.path.dirname(project)
#sys.path.append(workspace) 

#Add the path to 3rd party django application and to django itself.
#sys.path.append('C:\\yml\\_myScript_\\dj_things\\web_development\\svn_views\\django_src\\trunk')
#sys.path.append('C:\\yml\\_myScript_\\dj_things\\web_development\\svn_views\\django-registration')

sys.path.append('/home/yeealex/UBmatrixCalculator')
sys.path.append('/home/yeealex')

#change below to 'settings_production' for deployment, 'settings' for testing
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings_production'

import django.core.handlers.wsgi

application = django.core.handlers.wsgi.WSGIHandler()

