#include <gtk/gtk.h>
#include "starter.h"

typedef struct {
    GtkLabel *label;
    int count;
} Counter;

static void refresh_count(const Counter *counter)
{
    char *label = g_strdup_printf("Clicks: %d", counter->count);
    gtk_label_set_text(counter->label, label);
    g_free(label);
}

static void count_click(GtkButton *button, gpointer user_data)
{
    (void)button;
    Counter *counter = user_data;
    counter->count = starter_add(counter->count, 1);
    refresh_count(counter);
}

static void reset_click(GtkButton *button, gpointer user_data)
{
    (void)button;
    Counter *counter = user_data;
    counter->count = 0;
    refresh_count(counter);
}

static void activate(GtkApplication *application, gpointer user_data)
{
    (void)user_data;
    GtkWidget *window = gtk_application_window_new(application);
    GtkWidget *layout = gtk_box_new(GTK_ORIENTATION_VERTICAL, 12);
    GtkWidget *increment = gtk_button_new_with_label("Increment");
    GtkWidget *reset = gtk_button_new_with_label("Reset");
    GtkWidget *label = gtk_label_new("Clicks: 0");
    Counter *counter = g_new0(Counter, 1);
    counter->label = GTK_LABEL(label);
    g_object_set_data_full(G_OBJECT(window), "counter", counter, g_free);
    g_signal_connect(increment, "clicked", G_CALLBACK(count_click), counter);
    g_signal_connect(reset, "clicked", G_CALLBACK(reset_click), counter);
    gtk_box_append(GTK_BOX(layout), label);
    gtk_box_append(GTK_BOX(layout), increment);
    gtk_box_append(GTK_BOX(layout), reset);

    gtk_window_set_title(GTK_WINDOW(window), "__PROJECT_NAME__");
    gtk_window_set_default_size(GTK_WINDOW(window), 440, 280);
    gtk_widget_set_halign(layout, GTK_ALIGN_CENTER);
    gtk_widget_set_valign(layout, GTK_ALIGN_CENTER);
    gtk_window_set_child(GTK_WINDOW(window), layout);
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
