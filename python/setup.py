#!/usr/bin/env python

from distutils.core import setup

setup(
		name='Teleportd',
		version='0.3.2',
		author='Antoine Llorca',
		author_email='antoine@teleportd.com',
		packages=['teleportd', 'teleportd.test'],
		url='http://pypi.python.org/pypi/Teleportd/',
		license='LICENSE.txt',
		description='Teleportd API Python Wrapper',
		long_description=open('README.txt').read(),
		install_requires=[
				"pycurl >= 7.0.0",
		],
)