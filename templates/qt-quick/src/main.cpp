#include "starter.h"
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QVariant>

int main(int argc, char *argv[])
{
    QGuiApplication application(argc, argv);
    QQmlApplicationEngine engine;
    engine.loadFromModule("ProjectStarter", "Main");
    if (engine.rootObjects().isEmpty()) {
        return 1;
    }
    engine.rootObjects().first()->setProperty("title", QStringLiteral("__PROJECT_NAME__ | 2 + 3 = %1").arg(starter_add(2, 3)));
    return application.exec();
}
