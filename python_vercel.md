# Using the Python Runtime with Vercel Functions

Learn how to use the Python runtime to compile Python Vercel Functions on Vercel.

The Python runtime is available in [Beta](/docs/release-phases#beta) on [all plans](/docs/plans)

The Python runtime enables you to write Python code, including using [Django](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/django) and [Flask](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/flask), with Vercel Serverless Functions. You can use a specific [Python version](#python-version) as well as use a `requirements.txt` file to [install dependencies](#python-dependencies).

You can create your first function, available at the `/api` route, as follows:

```
from http.server import BaseHTTPRequestHandler
 
class handler(BaseHTTPRequestHandler):
 
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type','text/plain')
        self.end_headers()
        self.wfile.write('Hello, world!'.encode('utf-8'))
        return
```

A hello world Python API using Vercel Serverless Functions.

## [Python Version](#python-version)

By default, new projects will use the latest Python version available on Vercel.

Current available versions are:

*   3.12 (default)
*   3.9 (requires [legacy build image](/docs/builds/build-image/build-image#legacy-build-image))

You can specify which of the available Python versions to use by defining `python_version` in `Pipfile`:

```
[[source]]
url = "https://pypi.org/simple"
verify_ssl = true
name = "pypi"
 
[packages]
flask = "*"
 
[requires]
python_version = "3.12"
```

An example `Pipfile` generated with `pipenv install flask`.

The `python_version` must exactly match one of the options above or it will be ignored. When upgrading to `3.12`, ensure you set Node.js `20.x` or `22.x` in your [project settings](/docs/functions/runtimes/node-js#setting-the-node.js-version-in-project-settings).

## [Streaming Python functions](#streaming-python-functions)

Vercel Functions support streaming responses when using the Python runtime. This allows you to render parts of the UI as they become ready, letting users interact with your app before the entire page finishes loading.

## [Python Dependencies](#python-dependencies)

You can install dependencies for your Python projects by defining them in `requirements.txt` or a `Pipfile` with corresponding `Pipfile.lock`.

```
Flask==3.0.3
```

An example `requirements.txt` file that defines `Flask` as a dependency.

## [Advanced Python Usage](#advanced-python-usage)

For basic usage of the Python runtime, no configuration is required. Advanced usage of the Python runtime, such as with Flask and Django, requires some configuration.

The entry point of this runtime is a glob matching `.py` source files with one of the following variables defined:

*   `handler` that inherits from the `BaseHTTPRequestHandler` class
*   `app` that exposes a WSGI or ASGI Application

### [Reading Relative Files in Python](#reading-relative-files-in-python)

Python uses the current working directory when a relative file is passed to [open()](https://docs.python.org/3/library/functions.html#open).

The current working directory is the base of your project, not the `api/` directory.

For example, the following directory structure:

```
├── README.md
├── api
|  ├── user.py
├── data
|  └── file.txt
└── requirements.txt
```

With the above directory structure, your function in `api/user.py` can read the contents of `data/file.txt` in a couple different ways.

You can use the path relative to the project's base directory.

```
from http.server import BaseHTTPRequestHandler
from os.path import join
 
class handler(BaseHTTPRequestHandler):
 
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type','text/plain')
        self.end_headers()
        with open(join('data', 'file.txt'), 'r') as file:
          for line in file:
            self.wfile.write(line.encode())
        return
```

Or you can use the path relative to the current file's directory.

```
from http.server import BaseHTTPRequestHandler
from os.path import dirname, abspath, join
dir = dirname(abspath(__file__))
 
class handler(BaseHTTPRequestHandler):
 
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type','text/plain')
        self.end_headers()
        with open(join(dir, '..', 'data', 'file.txt'), 'r') as file:
          for line in file:
            self.wfile.write(line.encode())
        return
```

### [Web Server Gateway Interface](#web-server-gateway-interface)

The Web Server Gateway Interface (WSGI) is a calling convention for web servers to forward requests to web applications written in Python. You can use WSGI with frameworks such as Flask or Django.

*   [Deploy an example with Flask](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/flask)
*   [Deploy an example with Django](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/django)

### [Asynchronous Server Gateway Interface](#asynchronous-server-gateway-interface)

The Asynchronous Server Gateway Interface (ASGI) is a calling convention for web servers to forward requests to asynchronous web applications written in Python. You can use ASGI with frameworks such as [Sanic](https://sanic.readthedocs.io).

Instead of defining a `handler`, define an `app` variable in your Python file.

For example, define a `api/index.py` file as follows:

```
from sanic import Sanic
from sanic.response import json
app = Sanic()
 
 
@app.route('/')
@app.route('/<path:path>')
async def index(request, path=""):
    return json({'hello': path})
```

An example `api/index.py` file, using Sanic for a ASGI application.

Inside `requirements.txt` define:

```
sanic==19.6.0
```

An example `requirements.txt` file, listing `sanic` as a dependency.

Last updated on March 4, 2025