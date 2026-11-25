import unittest

from starter_package import greet


class GreetingTest(unittest.TestCase):
    def test_named_greeting(self):
        self.assertEqual(greet("Ada"), "Hello, Ada!")

    def test_blank_names_use_world(self):
        self.assertEqual(greet("  "), "Hello, world!")

    def test_trims_names(self):
        self.assertEqual(greet("  Ada  "), "Hello, Ada!")
