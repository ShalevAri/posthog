# Generated by Django 3.1.12 on 2021-10-20 10:53

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("posthog", "0177_path_cleaning_filters"),
    ]

    operations = [
        migrations.AlterModelTable(name="dashboarditem", table="posthog_dashboarditem",),
        migrations.RenameModel(old_name="DashboardItem", new_name="Insight",),
    ]
