#include <gtk/gtk.h>
#include "starter.h"

static void count_click(GtkButton *button, gpointer user_data)
{
    int *count = user_data;
    *count = starter_add(*count, 1);
    char *label = g_strdup_printf("Clicks: %d", *count);
    gtk_button_set_label(button, label);
    g_free(label);
}

static void activate(GtkApplication *application, gpointer user_data)
{
    (void)user_data;
    GtkWidget *window = gtk_application_window_new(application);
    GtkWidget *button = gtk_button_new_with_label("Click me");
    int *count = g_new0(int, 1);
    g_object_set_data_full(G_OBJECT(button), "click-count", count, g_free);
    g_signal_connect(button, "clicked", G_CALLBACK(count_click), count);

    gtk_window_set_title(GTK_WINDOW(window), "__PROJECT_NAME__");
    gtk_window_set_default_size(GTK_WINDOW(window), 440, 280);
    gtk_widget_set_halign(button, GTK_ALIGN_CENTER);
    gtk_widget_set_valign(button, GTK_ALIGN_CENTER);
    gtk_window_set_child(GTK_WINDOW(window), button);
    gtk_window_present(GTK_WINDOW(window));
}

int main(int argc, char **argv)
{
    GtkApplication *application = gtk_application_new("com.example.app-__PROJECT_SLUG__", (GApplicationFlags)0);
    g_signal_connect(application, "activate", G_CALLBACK(activate), NULL);
    const int status = g_application_run(G_APPLICATION(application), argc, argv);
    g_object_unref(application);
    return status;
}
